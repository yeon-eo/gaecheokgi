// 개척기 푸시 알림 보내기 — GitHub Actions 가 5분마다 실행한다.
// 비밀 키는 GitHub 저장소의 Secrets(FIREBASE_SA)에만 넣는다. 이 파일에는 비밀이 없다.
const admin = require('firebase-admin');
admin.initializeApp({credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA))});
const db = admin.firestore(), fcm = admin.messaging();
const {FieldPath, FieldValue} = admin.firestore;
const NOW = Date.now(), H = 3600000;

const EV = {
  gift:'선물을 보냈습니다', friendReq:'친구 신청을 보냈습니다', confess:'마음을 고백했습니다', propose:'청혼했습니다',
  partyInv:'조사대에 초대했습니다', friendAcc:'친구 신청을 받아 주었습니다', confessAcc:'고백을 받아 주었습니다', proposeAcc:'청혼을 받아 주었습니다',
  rescue:'쓰러진 당신을 구해 주었습니다', heal:'상처를 치료해 주었습니다', encourage:'격려를 보냈습니다', tea:'차를 대접했습니다', grant:'운영자 선물을 보냈습니다',
};

(async () => {
  const metaRef = db.doc('pushmeta/state');
  const meta = (await metaRef.get()).data() || {};
  const since = Math.max(meta.last || 0, NOW - 30*60000);
  const P = {};
  (await db.collection('push').get()).forEach(d => { P[d.id] = {ref:d.ref, ...d.data()}; });
  const names = {};
  (await db.collection('players').get()).forEach(d => { names[d.id] = (d.data() || {}).name || '누군가'; });
  const out = [];
  const pref = (uid, k) => !(P[uid] && P[uid].prefs && P[uid].prefs[k] === false);

  // 1) 때가 된 예정 알림 (탐사 완료·수확·부화·쓰러짐)
  for (const [uid, p] of Object.entries(P)){
    const due = Array.isArray(p.due) ? p.due : [];
    const keep = due.filter(d => d.at > NOW);
    for (const d of due.filter(d => d.at <= NOW && d.at > NOW - 6*H)){
      out.push({uid, title:d.title, body:d.body, tag:d.key, tab:d.tab});
      if (d.all) for (const o of Object.keys(P)) if (o !== uid && pref(o, 'rescue')) out.push({uid:o, title:d.allTitle || '구조 요청', body:d.allBody || '', tag:'res-' + d.key, tab:'social'});
    }
    if (keep.length !== due.length) await p.ref.update({due:keep});
  }
  // 2) 새 쪽지
  (await db.collection('mail').where('ts', '>', since).get()).forEach(m => {
    const x = m.data(); if (!x || x.read || !pref(x.to, 'social')) return;
    out.push({uid:x.to, title:'쪽지', body:`${names[x.from] || '누군가'}: ${String(x.text || '').slice(0, 60)}`, tag:'mail' + m.id, tab:'social'});
  });
  // 3) 선물·요청 같은 교류 소식 (앱이 열려 있으면 바로 처리되어 사라지므로, 남아 있는 것만 보낸다)
  (await db.collection('events').where('ts', '>', since).get()).forEach(e => {
    const x = e.data(); if (!x || !EV[x.type]) return;
    if (x.type !== 'rescue' && !pref(x.to, 'social')) return;
    out.push({uid:x.to, title:'개척기', body:`${names[x.from] || '누군가'}님이 ${EV[x.type]}${x.type === 'gift' && x.data && x.data.msg ? ` 「${String(x.data.msg).slice(0, 40)}」` : ''}`, tag:'ev' + e.id, tab:'social'});
  });

  let sent = 0, dead = 0;
  for (const m of out){
    const p = P[m.uid]; const tokens = Object.keys((p && p.tokens) || {});
    if (!tokens.length) continue;
    const r = await fcm.sendEachForMulticast({tokens,
      data:{title:String(m.title), body:String(m.body), tag:String(m.tag || ''), tab:String(m.tab || 'home')},
      webpush:{headers:{Urgency:'high', TTL:String(6*3600)}}});
    sent += r.successCount;
    for (let i = 0; i < r.responses.length; i++){
      const c = r.responses[i].error && r.responses[i].error.code;
      if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token' || c === 'messaging/invalid-argument'){
        dead++; await p.ref.update(new FieldPath('tokens', tokens[i]), FieldValue.delete()).catch(() => {});
      }
    }
  }
  await metaRef.set({last:NOW, sent, at:new Date(NOW).toISOString()});
  console.log(`알림 ${out.length}건 대상, ${sent}건 전송, 만료 토큰 ${dead}개 정리`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

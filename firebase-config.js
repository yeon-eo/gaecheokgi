// ─────────────────────────────────────────────
//  개척기 서버 설정 (Firebase 프로젝트: gaecheokgi)
//  owners: 운영 도구가 보이는 운영자 이메일
// ─────────────────────────────────────────────
window.FBCFG = {
  apiKey: "AIzaSyAgF8tdV0CGN9o80irCO3n4qhidO1W5_1U",
  authDomain: "gaecheokgi.firebaseapp.com",
  projectId: "gaecheokgi",
  storageBucket: "gaecheokgi.firebasestorage.app",
  messagingSenderId: "230797166010",
  appId: "1:230797166010:web:f83d4fd335b410cf360983",
  owners: ["archernem@gmail.com"]
};
window.FB_MODE = !!(window.FBCFG.apiKey && window.FBCFG.projectId && window.firebase);

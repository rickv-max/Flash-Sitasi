import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { api } from '../lib/api';

export function useAccount(notify) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState({ uid: null, profile: null, history: [], ready: false });
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (next) => { setUser(next); setAuthReady(true); });
  }, []);
  useEffect(() => {
    if (!user || !db) return;
    let active = true;
    let stopProfile = () => {};
    let stopHistory = () => {};
    api('profile', { user }).then((profile) => {
      if (!active) return;
      setData({ uid: user.uid, profile, history: [], ready: true, error: '' });
      stopProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (active && snap.exists()) setData((current) => ({ ...current, uid: user.uid, profile: snap.data() }));
      }, () => {
        const message = 'Sinkronisasi akun terhenti. Sesi mungkin dicabut; keluar dan masuk kembali.';
        if (active) setData((current) => ({ ...current, ready: false, error: message, history: [] }));
        notify(message, 'error');
      });
      stopHistory = onSnapshot(query(collection(db, 'users', user.uid, 'history'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
        if (active) setData((current) => ({ ...current, history: snap.docs.map((item) => ({ id: item.id, ...item.data() })) }));
      }, () => notify('Riwayat belum dapat dimuat. Coba muat ulang.', 'error'));
    }).catch((error) => {
      if (active) {
        setData({ uid: user.uid, profile: null, history: [], ready: false, error: error.message });
        notify(error.message, 'error');
      }
    });
    return () => { active = false; stopProfile(); stopHistory(); };
  }, [user, notify, attempt]);
  const login = async () => {
    if (!auth) throw new Error('Login belum tersedia. Kamu tetap bisa mencoba ruang kerja melalui demo.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { return (await signInWithPopup(auth, provider)).user; } catch (error) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return null;
      throw new Error(error.code === 'auth/user-disabled' ? 'Akun dinonaktifkan oleh admin. Hubungi pengelola.' : error.code === 'auth/popup-blocked' ? 'Izinkan jendela pop-up untuk masuk dengan Google.' : 'Belum berhasil masuk. Periksa koneksi dan coba kembali.');
    }
  };
  const logout = () => auth ? signOut(auth) : Promise.resolve();
  const blocked = data.profile?.status === 'blocked';
  return { user, authReady, ready: user && data.uid === user.uid && data.ready && !blocked,
    profile: user && data.uid === user.uid ? data.profile : null,
    history: user && data.uid === user.uid && !blocked ? data.history : [],
    error: user && data.uid === user.uid ? blocked ? 'Akun dinonaktifkan oleh admin. Hubungi pengelola.' : data.error : '', retry: () => setAttempt((current) => current + 1), login, logout };
}

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { AppUser } from "../types";

type AuthContextType = {
  // Firebase Auth のユーザー（未ログインは null）
  firebaseUser: User | null;
  // Firestore の users コレクションから取得したユーザー情報
  appUser: AppUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  appUser: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setAppUser(snap.data() as AppUser);
        } else {
          // 初回ログイン時（Googleログインなど）にusersドキュメントを自動作成
          const newUser: AppUser = {
            uid: user.uid,
            email: user.email ?? "",
            isAdmin: false,
          };
          await setDoc(userRef, newUser);
          setAppUser(newUser);
        }
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

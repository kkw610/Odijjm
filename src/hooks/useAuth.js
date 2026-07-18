import { useEffect, useState } from "react";
import { authReady } from "../firebase";

export function useAuth() {
  const [uid, setUid] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    authReady
      .then((user) => {
        if (!cancelled) setUid(user.uid);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { uid, error, loading: !uid && !error };
}

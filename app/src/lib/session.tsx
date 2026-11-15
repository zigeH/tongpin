import * as SecureStore from "expo-secure-store";
import { useMutation } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Id } from "./backend";

export type Profile = { userId: Id<"users">; nickname: string; color: string };

type Session = {
  loaded: boolean;
  profile: Profile | null;
  profiles: Profile[];
  register: (nickname: string) => Promise<Profile>;
  login: (nickname: string) => Promise<Profile>;
  switchTo: (userId: Id<"users">) => Promise<void>;
  forget: (userId: Id<"users">) => Promise<void>;
};

const PROFILES_KEY = "tongpin.profiles";
const CURRENT_KEY = "tongpin.currentUserId";

const SessionContext = createContext<Session | null>(null);

// 没有登录：在本机 SecureStore 里记住注册过的昵称（可以有多个，方便一台手机扮演 A 和 B）。
export function SessionProvider({ children }: { children: ReactNode }) {
  const registerMutation = useMutation(api.users.register);
  const loginMutation = useMutation(api.users.login);
  const [loaded, setLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentId, setCurrentId] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(PROFILES_KEY);
        setProfiles(stored ? (JSON.parse(stored) as Profile[]) : []);
        setCurrentId((await SecureStore.getItemAsync(CURRENT_KEY)) as Id<"users"> | null);
      } catch (error) {
        console.error("读取本机身份失败", error);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const save = useCallback(async (next: Profile[], nextCurrent: Id<"users"> | null) => {
    setProfiles(next);
    setCurrentId(nextCurrent);
    await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(next));
    if (nextCurrent) await SecureStore.setItemAsync(CURRENT_KEY, nextCurrent);
    else await SecureStore.deleteItemAsync(CURRENT_KEY);
  }, []);

  const register = useCallback(
    async (nickname: string) => {
      const profile = await registerMutation({ nickname });
      await save([...profiles, profile], profile.userId);
      return profile;
    },
    [profiles, registerMutation, save],
  );

  const login = useCallback(
    async (nickname: string) => {
      const profile = await loginMutation({ nickname });
      const known = profiles.some((p) => p.userId === profile.userId);
      await save(known ? profiles.map((p) => (p.userId === profile.userId ? profile : p)) : [...profiles, profile], profile.userId);
      return profile;
    },
    [loginMutation, profiles, save],
  );

  const switchTo = useCallback(async (userId: Id<"users">) => save(profiles, userId), [profiles, save]);

  const forget = useCallback(
    async (userId: Id<"users">) => {
      const next = profiles.filter((p) => p.userId !== userId);
      await save(next, currentId === userId ? (next[0]?.userId ?? null) : currentId);
    },
    [currentId, profiles, save],
  );

  const value = useMemo<Session>(
    () => ({
      loaded,
      profiles,
      profile: profiles.find((p) => p.userId === currentId) ?? null,
      register,
      login,
      switchTo,
      forget,
    }),
    [currentId, forget, loaded, login, profiles, register, switchTo],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession 必须在 SessionProvider 里用");
  return session;
}

// 已注册的当前用户（页面都在注册之后才能进入）。
export function useProfile(): Profile {
  const { profile } = useSession();
  if (!profile) throw new Error("还没有注册");
  return profile;
}

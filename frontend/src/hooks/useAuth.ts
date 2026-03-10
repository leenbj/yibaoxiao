import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface Profile {
  id: string
  name: string
  department: string
  email: string
  role: 'admin' | 'user'
  is_current: boolean
  created_at: string
  updated_at: string
}

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    const getSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        setState(prev => ({ ...prev, error: error.message, loading: false }))
        return
      }

      if (session?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('获取用户资料失败:', profileError)
        }

        setState({
          user: session.user,
          profile: profile as Profile | null,
          session,
          loading: false,
          error: profileError ? '获取用户资料失败' : null
        })
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profileError) {
            console.error('获取用户资料失败:', profileError)
          }

          setState({
            user: session.user,
            profile: profile as Profile | null,
            session,
            loading: false,
            error: profileError ? '获取用户资料失败' : null
          })
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            error: null
          })
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (
    email: string,
    password: string,
    name: string,
    department: string
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, department }
      }
    })

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      return { success: false, error: error.message }
    }

    // 检查用户是否创建成功
    if (!data.user) {
      setState(prev => ({ ...prev, loading: false, error: '注册失败：无法创建用户' }))
      return { success: false, error: '注册失败：无法创建用户' }
    }

    // 检查是否需要邮箱验证
    const requiresEmailConfirmation = data.user.identities && data.user.identities.length === 0

    // 等待 profile 触发器创建完成（最多等待3秒）
    let profile = null
    let retries = 0
    const maxRetries = 6

    while (!profile && retries < maxRetries) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileData) {
        profile = profileData as Profile
      } else {
        retries++
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    if (profile) {
      setState(prev => ({
        ...prev,
        user: data.user,
        profile,
        loading: false,
        error: null
      }))
    } else {
      setState(prev => ({ ...prev, loading: false }))
    }

    return {
      success: true,
      data,
      requiresEmailConfirmation,
      profile
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      return { success: false, error: error.message }
    }

    return { success: true, data }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setState(prev => ({ ...prev, error: error.message }))
      return { success: false, error: error.message }
    }
    return { success: true }
  }, [])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!state.user) return { success: false, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', state.user.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    setState(prev => ({ ...prev, profile: data as Profile }))
    return { success: true, data }
  }, [state.user])

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: !!state.user
  }
}

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setState({
          user: session.user,
          profile: profile as Profile,
          session,
          loading: false,
          error: null
        })
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          setState({
            user: session.user,
            profile: profile as Profile,
            session,
            loading: false,
            error: null
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

    return { success: true, data }
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

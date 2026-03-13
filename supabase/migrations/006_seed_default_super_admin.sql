-- Seed default super admin account
-- Email: wangbo@knet.cn
-- Password: 68719929
-- Role: admin
--
-- Notes:
-- 1. Password hash uses bcrypt via pgcrypto's crypt/gen_salt.
-- 2. We seed both auth.users and auth.identities so email/password login works.
-- 3. profiles is created by the existing handle_new_user() trigger, then normalized below.

-- Enable pgcrypto if not already enabled (required for crypt function)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'wangbo@knet.cn';

  IF v_user_id IS NULL THEN
    -- Generate new UUID for user
    v_user_id := gen_random_uuid();

    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'wangbo@knet.cn',
      crypt('68719929', gen_salt('bf')),
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"超级管理员","department":"管理部","role":"admin"}'::jsonb,
      v_now,
      v_now,
      '',
      '',
      '',
      ''
    );
  ELSE
    -- Update existing user's password and role
    UPDATE auth.users
    SET
      encrypted_password = crypt('68719929', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, v_now),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"admin","name":"超级管理员","department":"管理部"}'::jsonb,
      updated_at = v_now
    WHERE id = v_user_id;
  END IF;

  -- Ensure identity exists for email login
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE user_id = v_user_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      format('{"sub":"%s","email":"%s","email_verified":true}', v_user_id::text, 'wangbo@knet.cn')::jsonb,
      'email',
      v_now,
      v_now,
      v_now
    );
  END IF;

  -- Ensure profile exists and has admin role
  -- The handle_new_user trigger should create the profile, but we ensure it's correct
  INSERT INTO public.profiles (id, name, department, email, role, created_at, updated_at)
  VALUES (v_user_id, '超级管理员', '管理部', 'wangbo@knet.cn', 'admin', v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET
    email = 'wangbo@knet.cn',
    role = 'admin'::public.user_role,
    name = '超级管理员',
    department = '管理部',
    updated_at = v_now;

  RAISE NOTICE '默认超级管理员账户已创建/更新: wangbo@knet.cn (ID: %)', v_user_id;
END;
$$;

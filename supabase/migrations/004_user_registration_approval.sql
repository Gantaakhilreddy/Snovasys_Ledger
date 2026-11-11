-- Migration 004: Add PENDING and PENDING_APPROVAL status to profiles for admin approval workflow

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('ACTIVE', 'PENDING', 'PENDING_APPROVAL', 'SUSPENDED', 'DEACTIVATED'));


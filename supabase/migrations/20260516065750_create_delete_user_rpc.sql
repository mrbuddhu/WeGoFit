/*
  # Create delete_user RPC function

  Allows authenticated users to delete their own auth account.
  Called from the GoFit app's Delete Account flow.

  Security: SECURITY DEFINER so it can delete from auth.users,
  but only deletes the row matching the calling user's auth.uid().
*/

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

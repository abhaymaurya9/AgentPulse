from db.supabase_client import supabase

response = supabase.table("agents").select("*").execute()

print(response.data)
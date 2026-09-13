import os
import sys
import time

# Force UTF-8 for Windows PowerShell / CMD output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from supabase import create_client, Client
from google import genai
from google.genai import types

# Helper to load .env file if it exists
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    # strip inline comments if any
                    if " #" in val:
                        val = val.split(" #", 1)[0].strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val

load_env()

# Read config from environment (or .env)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "your_supabase_project_url")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "your_supabase_service_key")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "your_gemini_api_key")


def run():
    if "your_supabase_project_url" in SUPABASE_URL:
        print("⚠️ Please set your SUPABASE_URL, SUPABASE_SERVICE_KEY, and GEMINI_API_KEY in the script or as environment variables.")
        return

    print("Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("Initializing Gemini API Client...")
    ai_client = genai.Client(api_key=GEMINI_API_KEY)

    print("Fetching materials without embeddings...")
    # Fetch all materials where the embedding is currently null
    response = supabase.table("materials").select("id, standard_description, technical_specs, cnmc").is_("embedding", "null").execute()
    materials = response.data
    
    if not materials:
        print("[DONE] All materials already have embeddings! Nothing to do.")
        return

    print(f"Found {len(materials)} materials to process.\n")

    for idx, mat in enumerate(materials, start=1):
        # We combine the description and specs to create a rich semantic string for the embedding
        desc = mat.get("standard_description", "")
        specs = mat.get("technical_specs") or {}
        
        text_to_embed = f"Description: {desc}\nTechnical Specs: {specs}"
        mat_label = mat.get("cnmc") or mat.get("id")
        
        print(f"[{idx}/{len(materials)}] Generating embedding for: {mat_label}")
        
        try:
            # Call Gemini to get the embedding (768 dimensions matching pgvector schema)
            embedding_response = ai_client.models.embed_content(
                model='gemini-embedding-001',
                contents=text_to_embed,
                config=types.EmbedContentConfig(output_dimensionality=768),
            )
            vector = embedding_response.embeddings[0].values
            
            # Update the database
            supabase.table("materials").update({"embedding": vector}).eq("id", mat["id"]).execute()
            print(f"  [SUCCESS] Embedded and updated in Supabase!")
            
            # Sleep to respect the free tier rate limit (15 requests per minute for Gemini Flash/Embeddings)
            # 60s / 15 = 4s per request. If you are on a paid tier, you can remove this.
            if idx < len(materials):
                time.sleep(4)
                
        except Exception as e:
            print(f"  [ERROR] processing {mat_label}: {e}")

if __name__ == "__main__":
    run()

"""Explicit runtime capabilities, independent of the installed tool definitions."""
import os

RENDER_TOOL_NAMES = frozenset({"render_brand_direction", "run_brand_workflow", "get_render_job"})

def rendering_available():
    provider = os.getenv("IMAGE_GENERATION_PROVIDER", "openai").strip().lower()
    if provider == "mock":
        return True  # Local test transport only, never a production image.
    return (provider == "openai" and os.getenv("IMAGE_GENERATION_ENABLED") == "1"
            and bool(os.getenv("OPENAI_API_KEY", "").strip()))

def generation_handoff(retention_hours=168):
    if rendering_available():
        return {"mode":"plugin_rendering_available", "plugin_rendering_available":True,
                "instructions":"Utiliser render_brand_direction pour une route ou run_brand_workflow pour les trois planches, puis consulter get_render_job. Un fournisseur mock produit uniquement une fixture de test.",
                "storage_note":f"Rétention configurée : {retention_hours:g} heures."}
    return {"mode":"host_native", "plugin_rendering_available":False, "native_tool":"@Créer une image", "invocation":"conversation_follow_up",
            "instructions":"Dans ChatGPT, utiliser exclusivement « @Créer une image » avec le brief. Dans Codex, utiliser une capacité native seulement si elle est réellement disponible. Ne pas annoncer une image ni un rendu sans appel réel.",
            "storage_note":"Aucun rendu serveur actif. Les prompts ne sont pas des images générées."}

def require_rendering():
    if not rendering_available():
        raise ValueError("Plugin-side rendering is not enabled. Use the host image-generation tool with the returned concept-board prompt.")

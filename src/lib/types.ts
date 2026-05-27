export interface Funnel {
  id: string; created_at: string; updated_at: string; ad_url: string | null; screenshot_url: string | null;
  ad_copy: string | null; cta: string | null; landing_url: string | null;
  format: "video" | "imagen" | "carrusel" | null; notes: string | null;
  total_questions: number; funnel_style_notes: string | null;
}
export interface FunnelSlide {
  id: string; funnel_id: string; slide_order: number;
  slide_type: "question" | "intro" | "result" | "offer" | "other";
  question_text: string | null; options: SlideOption[];
  screenshot_url: string | null; decoration_type: "emojis" | "images" | "none";
  notes: string | null; style_notes: string | null;
}
export interface SlideOption { text: string; emoji?: string; image_url?: string; notes?: string }

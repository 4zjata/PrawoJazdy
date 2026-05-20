// Schema is managed by FastAPI backend — this file defines TypeScript types only
// The Express server proxies all API calls to FastAPI on port 8000

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
  last_active: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Question {
  id: number;
  question_number: string;
  question_text: string;
  answer_a: string | null;
  answer_b: string | null;
  answer_c: string | null;
  question_type: "TAK_NIE" | "ABC";
  media_filename: string | null;
  scope: string;
  points: number;
  categories: string;
  question_text_en: string | null;
  answer_a_en: string | null;
  answer_b_en: string | null;
  answer_c_en: string | null;
}

export interface AnswerResponse {
  question_id: number;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points: number;
  explanation: string | null;
}

export interface ExamQuestion {
  question_order: number;
  question_id: number;
  question_number: string;
  question_text: string;
  answer_a: string | null;
  answer_b: string | null;
  answer_c: string | null;
  question_type: "TAK_NIE" | "ABC";
  media_filename: string | null;
  points: number;
  scope: string;
}

export interface ExamSession {
  session_id: string;
  category: string;
  total_questions: number;
  max_points: number;
  time_limit_minutes: number;
  questions: ExamQuestion[];
}

export interface ExamAnswerDetail {
  question_order: number;
  question_id: number;
  question_text: string;
  user_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  points_earned: number;
  points_possible: number;
}

export interface ExamResult {
  session_id: string;
  category: string;
  started_at: string;
  finished_at: string | null;
  total_points: number;
  max_points: number;
  passed: boolean;
  pass_threshold: number;
  answers: ExamAnswerDetail[];
}

export interface ExamHistoryItem {
  session_id: string;
  category: string;
  started_at: string;
  finished_at: string | null;
  total_points: number | null;
  max_points: number;
  passed: boolean | null;
  is_completed: boolean;
}

export interface Flashcard {
  id: number;
  sign_code: string;
  sign_name: string;
  sign_category: string;
  description: string;
  image_filename: string | null;
}

export interface ReadinessResponse {
  category: string;
  exams_taken: number;
  ema: number | null;
  variance: number | null;
  stability_penalty: number;
  readiness_score: number | null;
  status: "GOTOWY" | "PRAWIE_GOTOWY" | "W_TRAKCIE_NAUKI" | "WYMAGA_WIECEJ_NAUKI";
  last_scores: number[];
  message: string;
}

export interface GamificationProfile {
  total_points: number;
  level: number;
  exams_taken: number;
  exams_passed: number;
  questions_answered: number;
  questions_correct: number;
  accuracy_percent: number;
  current_streak: number;
  best_streak: number;
  last_activity_date: string | null;
  badges: string[];
  next_level_points: number;
}

export interface LeaderboardEntry {
  username: string;
  total_points: number;
  level: number;
  exams_passed: number;
}

export interface QuestionStats {
  category: string;
  total_questions: number;
  questions_answered: number;
  questions_correct: number;
  accuracy_percent: number;
  questions_due_for_review: number;
}

export interface IntersectionScenario {
  id: number;
  name: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  image_filename: string | null;
}

export interface Vehicle {
  id: number;
  vehicle_label: string;
  vehicle_type: "CAR" | "TRAM" | "EMERGENCY" | "TRUCK" | "BICYCLE" | "PEDESTRIAN" | "USER";
  direction_from: string;
  direction_to: string;
  position_description: string;
}

export interface IntersectionDetail extends IntersectionScenario {
  scenario_data: Record<string, any> | null;
  vehicles: Vehicle[];
}

export interface Violation {
  yielding_vehicle: string;
  priority_vehicle: string;
  rule: string;
  message: string;
}

export interface SolveResponse {
  is_correct: boolean;
  submitted_order: string[];
  violations: Violation[];
  correct_order_example: string[] | null;
}

export interface HintResponse {
  scenario_id: number;
  hint_type: string;
  hint: string;
  vehicles_that_go_first: string[];
}

export interface PaginationMeta {
  count: number;
  page: number;
  limit: number;
  pages: number;
  previous: number | null;
  next: number | null;
  from: number;
  to: number;
}

export interface ApiListResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export type ClipUpdatePayload = {
  final_text?: string | null;
  status?: string;
  ignored?: boolean;
};



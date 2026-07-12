type ApiErrorBody = {
  error?: {
    message?: string;
    code?: string;
    details?: unknown;
  };
};

function fallbackForStatus(response: Response, fallback: string): string {
  if (response.status === 401) return "Please sign in to continue.";
  if (response.status === 403) return "You do not have permission to do that.";
  if (response.status === 404) return "That item could not be found.";
  if (response.status === 409) return "That change conflicts with existing data.";
  if (response.status === 429) return "Too many requests. Please wait and try again.";
  if (response.status === 503) return "This service is temporarily unavailable.";
  if (response.status >= 500) return "Something went wrong on our side. Please try again.";
  return fallback;
}

export async function readApiResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw new Error(json.error?.message ?? fallbackForStatus(response, fallback));
  }

  return json as T;
}

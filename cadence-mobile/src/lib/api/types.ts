export interface Me {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  handle: string;
  intent: string;
  pillars: string[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public bodyText: string,
  ) {
    super(`API ${status}: ${bodyText}`);
  }
}

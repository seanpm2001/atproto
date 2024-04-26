export abstract class SessionManager {
  abstract fetchHandler(url: string, reqInit: RequestInit): Promise<Response>
  abstract getDid(): string | PromiseLike<string>

  /** @deprecated only used for a very particular use-case in the official Bluesky app */
  abstract getServiceUrl(): URL | PromiseLike<URL>
}

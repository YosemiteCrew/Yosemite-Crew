export interface ContactUsBody {
    querytype: string;
    message: string;
    subject: string;
    requests: string | { question: string; answer: string }[];
}
export interface TypedRequestBody<T> extends Express.Request {
  body: T;
}
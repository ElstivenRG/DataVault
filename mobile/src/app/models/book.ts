export interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
}

export interface BooksResponse {
  items: Book[];
  total?: number;
}

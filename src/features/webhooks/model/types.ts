export type Webhook = {
  id: string;
  name: string;
  url: string;
  active: boolean;
  created_at: string;
};

export type WebhookUpdate = {
  name: string;
  url: string;
};

export type WebhookListParams = {
  page: number;
  limit: number;
  search: string;
};

export type WebhookListResponse = {
  data: Webhook[];
  paging: {
    pages: {
      current: number;
      last: number;
    };
    results: {
      total: number;
      limitation: number;
    };
  };
};

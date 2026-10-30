import { Input, InputGroup } from '@chakra-ui/react';

type WebhookSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function WebhookSearch({ value, onChange }: WebhookSearchProps) {
  return (
    <InputGroup
      w="full"
      startElement={
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      }
    >
      <Input
        type="search"
        aria-label="Search webhooks"
        placeholder="Search by name..."
        value={value}
        bg="white"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </InputGroup>
  );
}

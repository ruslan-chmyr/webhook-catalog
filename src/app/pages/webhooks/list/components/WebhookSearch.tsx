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
        aria-label="Search movies"
        placeholder="Search by title..."
        value={value}
        size="md"
        bg="white"
        borderColor="gray.200"
        rounded="lg"
        ps="10"
        _focusVisible={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </InputGroup>
  );
}

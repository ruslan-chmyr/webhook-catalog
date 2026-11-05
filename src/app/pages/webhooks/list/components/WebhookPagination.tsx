import { Button, HStack, Text, VisuallyHidden } from '@chakra-ui/react';

type WebhookPaginationProps = {
  current: number;
  last: number | undefined;
  summary: string | undefined;
  onPrevious: () => void;
  onNext: () => void;
  onPage: (page: number) => void;
};

export function WebhookPagination({ current, last, summary, onPrevious, onNext, onPage }: WebhookPaginationProps) {
  const pages = last === undefined ? [] : Array.from({ length: last }, (_, index) => index + 1);
  const label = last === undefined ? `Page ${current}` : `Page ${current} of ${last}`;

  return (
    <HStack as="nav" aria-label="Pagination" justify="flex-end" gap="1" wrap="wrap" flexShrink={0}>
      <VisuallyHidden>{label}</VisuallyHidden>
      {summary ? (
        <Text color="gray.600" fontSize="sm" mr="auto" display={{ base: 'none', sm: 'block' }}>
          {summary}
        </Text>
      ) : null}
      <Button
        type="button"
        size="sm"
        minW="8"
        h="8"
        variant="outline"
        borderColor="gray.200"
        bg="white"
        aria-label="Previous"
        disabled={current <= 1}
        onClick={onPrevious}
      >
        <Chevron direction="left" />
      </Button>
      {pages.map((page) => {
        const isCurrent = page === current;

        return (
          <Button
            key={page}
            type="button"
            size="sm"
            minW="8"
            h="8"
            px="2"
            variant={isCurrent ? 'solid' : 'outline'}
            bg={isCurrent ? 'gray.900' : 'white'}
            color={isCurrent ? 'white' : 'gray.800'}
            borderColor="gray.200"
            _hover={{ bg: isCurrent ? 'gray.800' : 'gray.50' }}
            aria-label={`Page ${page}`}
            aria-current={isCurrent ? 'page' : undefined}
            disabled={isCurrent}
            onClick={() => {
              onPage(page);
            }}
          >
            {page}
          </Button>
        );
      })}
      <Button
        type="button"
        size="sm"
        minW="8"
        h="8"
        variant="outline"
        borderColor="gray.200"
        bg="white"
        aria-label="Next"
        disabled={last === undefined || current >= last}
        onClick={onNext}
      >
        <Chevron direction="right" />
      </Button>
    </HStack>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  );
}

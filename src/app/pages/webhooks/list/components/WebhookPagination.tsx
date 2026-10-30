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
    <HStack as="nav" aria-label="Pagination" justify="space-between" gap="3" wrap="wrap">
      <Text color="gray.600" fontSize="sm">
        {summary ?? ''}
      </Text>
      <HStack gap="1">
        <VisuallyHidden>{label}</VisuallyHidden>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
              minW="9"
              variant={isCurrent ? 'solid' : 'outline'}
              colorPalette={isCurrent ? 'blue' : 'gray'}
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
          variant="outline"
          aria-label="Next"
          disabled={last === undefined || current >= last}
          onClick={onNext}
        >
          <Chevron direction="right" />
        </Button>
      </HStack>
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

import type { ReactNode } from 'react';
import { Button, HStack, Text } from '@chakra-ui/react';
import type { CatalogViewMode } from '../hooks/useCatalogViewMode';

type CatalogViewSwitcherProps = {
  mode: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
};

export function CatalogViewSwitcher({ mode, onChange }: CatalogViewSwitcherProps) {
  return (
    <HStack
      role="group"
      aria-label="Catalog view"
      gap="0"
      flexShrink={0}
      p="0.5"
      bg="gray.100"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="lg"
    >
      <ViewButton
        label="Grid"
        pressed={mode === 'grid'}
        onClick={() => {
          onChange('grid');
        }}
      >
        <GridIcon />
      </ViewButton>
      <ViewButton
        label="Table"
        pressed={mode === 'table'}
        onClick={() => {
          onChange('table');
        }}
      >
        <TableIcon />
      </ViewButton>
    </HStack>
  );
}

type ViewButtonProps = {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
};

function ViewButton({ label, pressed, onClick, children }: ViewButtonProps) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      h="8"
      px="3"
      gap="1.5"
      fontWeight="medium"
      rounded="md"
      bg={pressed ? 'gray.900' : 'transparent'}
      color={pressed ? 'white' : 'gray.700'}
      _hover={{ bg: pressed ? 'gray.800' : 'white' }}
      _focusVisible={{ outline: '2px solid', outlineColor: 'blue.500', outlineOffset: '2px' }}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
      <Text as="span">{label}</Text>
    </Button>
  );
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

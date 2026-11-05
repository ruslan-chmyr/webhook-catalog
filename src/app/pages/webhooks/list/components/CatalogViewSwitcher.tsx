import { Button, HStack } from '@chakra-ui/react';
import type { CatalogViewMode } from '../hooks/useCatalogViewMode';

type CatalogViewSwitcherProps = {
  mode: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
};

export function CatalogViewSwitcher({ mode, onChange }: CatalogViewSwitcherProps) {
  return (
    <HStack role="group" aria-label="Catalog view" gap="1" flexShrink={0}>
      <Button
        type="button"
        size="xs"
        variant={mode === 'table' ? 'solid' : 'outline'}
        aria-pressed={mode === 'table'}
        onClick={() => {
          onChange('table');
        }}
      >
        Table
      </Button>
      <Button
        type="button"
        size="xs"
        variant={mode === 'grid' ? 'solid' : 'outline'}
        aria-pressed={mode === 'grid'}
        onClick={() => {
          onChange('grid');
        }}
      >
        Grid
      </Button>
    </HStack>
  );
}

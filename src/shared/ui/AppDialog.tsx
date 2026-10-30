import { Button, CloseButton, Dialog } from '@chakra-ui/react';
import type { FormEvent, ReactNode } from 'react';

type AppDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  formId?: string;
  cancelButtonText?: string;
  submitButtonText?: string;
  closeDisabled?: boolean;
  closeOnEscape?: boolean;
  closeOnInteractOutside?: boolean;
  onClose: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

export function AppDialog({
  open,
  title,
  onClose,
  onSubmit,
  children,
  formId = 'app-dialog-form',
  cancelButtonText,
  submitButtonText,
  closeDisabled = false,
  closeOnEscape = true,
  closeOnInteractOutside = true,
}: AppDialogProps) {
  const showFooter = cancelButtonText !== undefined || submitButtonText !== undefined;

  return (
    <Dialog.Root
      open={open}
      closeOnEscape={closeOnEscape && !closeDisabled}
      closeOnInteractOutside={closeOnInteractOutside && !closeDisabled}
      onOpenChange={(details) => {
        if (!details.open) {
          onClose();
        }
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="md">
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {onSubmit === undefined ? (
              children
            ) : (
              <form
                id={formId}
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmit(event);
                }}
              >
                {children}
              </form>
            )}
          </Dialog.Body>
          {showFooter ? (
            <Dialog.Footer>
              {cancelButtonText === undefined ? null : (
                <Button type="button" variant="outline" disabled={closeDisabled} onClick={onClose}>
                  {cancelButtonText}
                </Button>
              )}
              {submitButtonText === undefined ? null : (
                <Button type="submit" form={formId} colorPalette="blue" disabled={closeDisabled}>
                  {submitButtonText}
                </Button>
              )}
            </Dialog.Footer>
          ) : null}
          <Dialog.CloseTrigger asChild disabled={closeDisabled}>
            <CloseButton size="sm" disabled={closeDisabled} aria-label="Close" />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

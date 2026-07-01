import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useT } from '../../contexts/I18nContext.jsx';

export default function ConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  cancelLabel,
  confirmLabel,
  variant = 'destructive',
  onConfirm,
}) {
  const t = useT();
  const cancel = cancelLabel ?? t('common.cancel');
  const confirm = confirmLabel ?? t('common.confirm');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <AlertDialogAction
            className={
              variant === 'destructive' ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
              : variant === 'success' ? 'bg-green-600 text-white hover:bg-green-700'
              : undefined
            }
            onClick={() => { onConfirm(); }}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

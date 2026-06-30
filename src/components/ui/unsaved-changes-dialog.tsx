import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user confirms they want to leave and discard changes. */
  onConfirm: () => void;
  language: "en" | "ro";
}

/**
 * Styled "discard unsaved changes?" confirmation, shared by the story editors.
 * Replaces the native window.confirm() so the prompt matches the rest of the
 * app (same AlertDialog used for destructive admin/profile actions).
 */
export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  language,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {language === "en" ? "Discard unsaved changes?" : "Renunți la modificările nesalvate?"}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {language === "en"
            ? "You have changes that haven't been saved yet. If you leave now, they'll be lost."
            : "Ai modificări care nu au fost încă salvate. Dacă pleci acum, se vor pierde."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>
          {language === "en" ? "Keep editing" : "Continuă editarea"}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {language === "en" ? "Discard & leave" : "Renunță și pleacă"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

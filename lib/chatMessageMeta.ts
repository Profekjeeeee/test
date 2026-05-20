/** Сообщение считается отредактированным, если updated_at заметно позже created_at. */
export function messageWasEdited(createdAt: number, editedAt?: number | null): boolean {
  if (editedAt == null || !Number.isFinite(editedAt)) return false;
  return editedAt - createdAt > 1500;
}

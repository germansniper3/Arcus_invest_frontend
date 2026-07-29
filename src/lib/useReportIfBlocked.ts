import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isApprovalBlocked } from './api';

/** The server's sentinel for "no linked record" — sent to unassign, rather than
 *  omitting the field, which would mean "leave unchanged". */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Reports a rejection that came from the approvals engine, and offers a way to
 * the queue.
 *
 * A blocked action is not an error the user can fix by retrying, so it must not
 * read like one: the toast carries the server's explanation and a route to the
 * request that is now waiting. It returns true when it handled the error, so
 * callers read `if (!reportIfBlocked(err)) toast.error(...)` and never show two
 * messages for one failure.
 *
 * A hook rather than a plain function because the navigation target is a real
 * URL now that the back-office sections are routed — which also means an
 * extracted feature can offer it without the shell passing anything down.
 */
export function useReportIfBlocked() {
  const navigate = useNavigate();
  return useCallback(
    (err: unknown): boolean => {
      if (!isApprovalBlocked(err)) return false;
      toast.error((err as Error).message, {
        action: { label: 'View', onClick: () => navigate('/admin/approvals') },
        duration: 8000,
      });
      return true;
    },
    [navigate],
  );
}

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { SkillResultModal } from '@/components/ui/SkillResultModal';
import { skillsApi } from '@/services/skillsApi';
import type { JobDetail } from '@/types';
import type { OutreachContactDraft, OutreachData } from '@/types/skills-data';

type Props = {
  open: boolean;
  onClose: () => void;
  job: JobDetail;
};

function isOutreachDraft(data: unknown): data is OutreachData & { contacts: OutreachContactDraft[] } {
  return Boolean(data && typeof data === 'object' && Array.isArray((data as OutreachData).contacts));
}

export function OutreachDraftModal({ open, onClose, job }: Props) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<(OutreachData & { contacts?: OutreachContactDraft[] }) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await skillsApi.outreachDraft(job.userJobId);
      setDraft(data);
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e, 'Could not draft outreach. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [job.userJobId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  return (
    <SkillResultModal
      open={open}
      onClose={onClose}
      title="Draft Outreach"
      subtitle={`${job.title} · ${job.company}`}
      testId="outreach-draft-modal"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
            Re-run
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <p className="font-body-md text-body-md text-on-surface-variant mb-4">
        Top two contacts to approach for this role, with ready-to-send messages in every common format.
      </p>

      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center" data-testid="outreach-draft-loading">
          <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
          <span>Drafting outreach…</span>
        </div>
      )}

      {!loading && draft && isOutreachDraft(draft) && (
        <div className="space-y-6">
          {draft.contacts.map((contact, idx) => (
            <section
              key={`${contact.name}-${idx}`}
              className="rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-4"
            >
              <div>
                <p className="font-label-sm text-label-sm text-primary uppercase">
                  Priority {contact.priority ?? idx + 1}
                </p>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{contact.name}</h3>
                <p className="font-body-sm text-body-sm text-secondary">{contact.title}</p>
                {contact.whyThisPerson && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">{contact.whyThisPerson}</p>
                )}
              </div>

              {contact.formats && (
                <div className="space-y-3">
                  <FormatBlock
                    label="LinkedIn connection request"
                    {...(contact.formats.linkedInConnection
                      ? { text: contact.formats.linkedInConnection }
                      : {})}
                    onCopy={copy}
                  />
                  <FormatBlock
                    label="LinkedIn message"
                    {...(contact.formats.linkedInMessage ? { text: contact.formats.linkedInMessage } : {})}
                    onCopy={copy}
                  />
                  <FormatBlock
                    label="Cold email"
                    text={
                      contact.formats.coldEmailBody
                        ? `Subject: ${contact.formats.coldEmailSubject ?? ''}\n\n${contact.formats.coldEmailBody}`
                        : ''
                    }
                    onCopy={copy}
                  />
                  <FormatBlock
                    label="Follow-up"
                    {...(contact.formats.followUp ? { text: contact.formats.followUp } : {})}
                    onCopy={copy}
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </SkillResultModal>
  );
}

function FormatBlock({
  label,
  text,
  onCopy,
}: {
  label: string;
  text?: string;
  onCopy: (t: string) => void;
}) {
  if (!text?.trim()) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-label-sm text-label-sm text-secondary uppercase">{label}</p>
        <button type="button" className="text-primary font-label-sm hover:underline" onClick={() => onCopy(text)}>
          Copy
        </button>
      </div>
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-body-sm text-body-sm whitespace-pre-wrap text-on-surface">
        {text}
      </div>
    </div>
  );
}

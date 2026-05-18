import { Resend } from "resend";
import type { Workout } from "../workout";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(workout: Workout): string {
  const thumbnail = `https://img.youtube.com/vi/${workout.video.youtubeId}/hqdefault.jpg`;

  const drills = workout.drills
    .map(
      (d) => `
    <div style="margin: 16px 0; padding: 12px; border-left: 3px solid #444;">
      <div style="font-weight: 600; font-size: 16px;">${escapeHtml(d.name)}</div>
      <div style="color: #666; font-size: 13px; margin: 4px 0;">
        ${d.duration} min · ${escapeHtml(d.sets)} · refs: ${escapeHtml(d.references.join(", "))}
      </div>
      <div style="font-size: 14px;">${escapeHtml(d.cues)}</div>
    </div>`,
    )
    .join("\n");

  return `<!doctype html>
<html>
<body style="font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111;">
  <div style="font-size: 12px; color: #888;">${workout.date}</div>
  <h1 style="font-size: 22px; margin: 4px 0 16px;">${escapeHtml(workout.focus)}</h1>

  <p style="font-size: 15px; line-height: 1.5;">${escapeHtml(workout.narrative)}</p>

  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-top: 32px;">Today's reading</h2>
  <a href="${escapeHtml(workout.paper.url)}" style="font-size: 15px; color: #0070f3;">${escapeHtml(workout.paper.title)}</a>
  <p style="font-size: 14px; color: #333;">${escapeHtml(workout.paper.notes)}</p>

  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-top: 32px;">Today's video</h2>
  <a href="${escapeHtml(workout.video.url)}">
    <img src="${thumbnail}" alt="${escapeHtml(workout.video.title)}" style="max-width: 100%; border-radius: 8px;" />
  </a>
  <div style="font-size: 15px; margin-top: 8px;">
    <a href="${escapeHtml(workout.video.url)}" style="color: #0070f3;">${escapeHtml(workout.video.title)}</a>
  </div>
  <p style="font-size: 14px; color: #333;">${escapeHtml(workout.video.notes)}</p>

  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-top: 32px;">Drills</h2>
  ${drills}
</body>
</html>`;
}

export interface SendEmailOptions {
  workout: Workout;
  to: string;
  from?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  const resend = new Resend(apiKey);
  const from = opts.from ?? process.env.EMAIL_FROM ?? "training-plan@resend.dev";

  const subject = `Workout — ${opts.workout.date} — ${opts.workout.focus.slice(0, 60)}`;
  const html = renderHtml(opts.workout);

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
}

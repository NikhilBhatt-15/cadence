"use client";

/* eslint-disable @next/next/no-img-element */
import { PlatformIcon } from "@/components/platform-icon";
import type { PlatformSummary } from "@/lib/platforms";
import type { Author } from "./composer";

type Platform = PlatformSummary & { handle: string | null };

function Avatar({ author, size }: { author: Author; size: number }) {
  return author.avatarUrl ? (
    <img src={author.avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full" />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-ink text-white" style={{ width: size, height: size }}>
      {author.name[0]}
    </span>
  );
}

/** Rough renderings of how the post will look. Linkifies URLs, hashtags and mentions. */
function RichText({ text, linkClass }: { text: string; linkClass: string }) {
  const pieces = text.split(/(https?:\/\/\S+|#[\p{L}\d_]+|@\w+)/u);
  return (
    <>
      {pieces.map((piece, i) =>
        i % 2 === 1 ? (
          <span key={i} className={linkClass}>
            {piece.startsWith("http") ? piece.replace(/^https?:\/\//, "").slice(0, 30) + (piece.length > 38 ? "…" : "") : piece}
          </span>
        ) : (
          <span key={i}>{piece}</span>
        ),
      )}
    </>
  );
}

export function Preview({ author, parts, platforms }: { author: Author; parts: string[]; platforms: Platform[] }) {
  if (parts.length === 0) {
    return <p className="py-16 text-center text-mute">Nothing to preview yet. Write or draft something first.</p>;
  }
  const shown = platforms.length ? platforms : [{ id: "x", handle: null } as Platform];

  return (
    <div className="space-y-8">
      {shown.map((p) => (
        <div key={p.id}>
          <p className="mb-3 flex items-center gap-1.5 text-sm text-mute">
            <PlatformIcon id={p.id} size={12} /> On {p.id === "x" ? "X" : "LinkedIn"}
          </p>
          {p.id === "linkedin" ? (
            <LinkedInPreview author={author} text={parts.join("\n\n")} />
          ) : (
            <XPreview author={author} handle={p.handle ?? author.login} parts={parts} />
          )}
        </div>
      ))}
    </div>
  );
}

function XPreview({ author, handle, parts }: { author: Author; handle: string; parts: string[] }) {
  return (
    <div className="rounded-[16px] border border-[#cfd9de] bg-white px-4 pt-3 font-[system-ui,-apple-system,'Segoe_UI',sans-serif] text-[15px] text-[#0f1419]">
      {parts.map((text, i) => (
        <div key={i} className="relative flex gap-3 pb-3">
          {i < parts.length - 1 && <span className="absolute top-12 bottom-0 left-5 w-0.5 bg-[#cfd9de]" aria-hidden />}
          <Avatar author={author} size={40} />
          <div className="min-w-0 flex-1">
            <p className="flex gap-1 truncate leading-5">
              <span className="font-bold">{author.name}</span>
              <span className="text-[#536471]">@{handle} · now</span>
            </p>
            <p className="mt-0.5 leading-5 break-words whitespace-pre-wrap">
              <RichText text={text} linkClass="text-[#1d9bf0]" />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkedInPreview({ author, text }: { author: Author; text: string }) {
  const long = text.length > 210;
  return (
    <div className="rounded-[10px] border border-[#e0dfdc] bg-white p-4 font-[system-ui,-apple-system,'Segoe_UI',sans-serif] text-[14px] text-[#191919]">
      <div className="mb-3 flex items-center gap-2">
        <Avatar author={author} size={48} />
        <div className="leading-tight">
          <p className="font-semibold">{author.name}</p>
          <p className="text-xs text-[#666]">Now · Public</p>
        </div>
      </div>
      <p className="leading-[1.45] break-words whitespace-pre-wrap">
        <RichText text={long ? text.slice(0, 210) : text} linkClass="font-semibold text-[#0a66c2]" />
        {long && <span className="text-[#666]">…see more</span>}
      </p>
    </div>
  );
}

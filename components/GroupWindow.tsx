"use client";

import { useState } from "react";
import { useBooth } from "@/components/BoothProvider";

export default function GroupWindow({ onJoined }: { onJoined?: () => void }) {
  const { me, groups, group, members, selectGroup, createGroup, joinGroup, leaveGroup, renameMe } = useBooth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(ok);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {group ? (
        <>
          {groups.length > 1 && (
            <div className="field-row">
              <label htmlFor="group-select">Group</label>
              <select id="group-select" value={group.id} onChange={(e) => selectGroup(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p>
            <b>{group.name}</b> · invite-only
          </p>
          <div className="invite-code" aria-label="Invite code">
            {group.invite_code}
          </div>
          <p className="hint">Give this code to friends so they can join. Only members can see the group&apos;s posts.</p>
          <fieldset>
            <legend>Members ({members.length})</legend>
            <ul className="tree-view">
              {members.map((m) => (
                <li key={m.id}>
                  {m.display_name}
                  {m.id === me?.id ? " (you)" : ""}
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      ) : (
        <p>You&apos;re not in a group yet. Start one, or join a friend&apos;s with their invite code.</p>
      )}

      <fieldset>
        <legend>Join with a code</legend>
        <div className="field-row">
          <input
            aria-label="Invite code"
            value={code}
            maxLength={6}
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            disabled={busy || code.trim().length !== 6}
            onClick={() =>
              run(async () => {
                await joinGroup(code);
                onJoined?.();
              }, "Joined!")
            }
          >
            Join
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Start a new group</legend>
        <div className="field-row">
          <input aria-label="Group name" value={name} maxLength={40} placeholder="Night owls" onChange={(e) => setName(e.target.value)} />
          <button
            disabled={busy || !name.trim()}
            onClick={() =>
              run(async () => {
                await createGroup(name);
                onJoined?.();
              }, "Group created! Share the invite code.")
            }
          >
            Create
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Your name</legend>
        <div className="field-row">
          <input
            aria-label="Display name"
            value={displayName}
            maxLength={30}
            placeholder={me?.display_name ?? ""}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button disabled={busy || !displayName.trim()} onClick={() => run(() => renameMe(displayName), "Name saved.")}>
            Save
          </button>
        </div>
      </fieldset>

      {group && (
        <div className="field-row">
          {confirmLeave ? (
            <>
              <span>Leave {group.name}?</span>
              <button onClick={() => run(leaveGroup, "You left the group.")}>Leave</button>
              <button onClick={() => setConfirmLeave(false)}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmLeave(true)}>Leave group</button>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}

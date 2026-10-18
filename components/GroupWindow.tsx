"use client";

import { useState } from "react";
import { useBooth } from "@/components/BoothProvider";
import { Avatar, Modal } from "@/components/ui";

type Dialog = null | "join" | "create";

/** Your groups, the current group's invite code and members, and separate Join / Create flows. */
export default function GroupWindow() {
  const { me, groups, group, members, selectGroup, createGroup, joinGroup, leaveGroup } = useBooth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack">
      {groups.length > 1 && (
        <div className="field-row">
          <span className="control-label">Your groups</span>
          <div className="filter-chips" role="radiogroup" aria-label="Your groups">
            {groups.map((g) => (
              <button
                key={g.id}
                role="radio"
                aria-checked={group?.id === g.id}
                className={group?.id === g.id ? "small pill-pink" : "small"}
                onClick={() => {
                  selectGroup(g.id);
                  setCopied(false);
                  setConfirmLeave(false);
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {group ? (
        <>
          <p className="group-name">
            <b>{group.name}</b> <span className="hint">· invite-only</span>
          </p>
          <div className="invite-row">
            <div className="invite-code" aria-label="Invite code">
              {group.invite_code}
            </div>
            <button
              className="pill-blue"
              onClick={() => {
                void navigator.clipboard?.writeText(group.invite_code).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="hint">Give this code to friends so they can join. Only members can see the group&apos;s posts.</p>
          <fieldset>
            <legend>Members ({members.length})</legend>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.id}>
                  <Avatar id={m.id} name={m.display_name} size={32} />
                  {m.display_name}
                  {m.id === me?.id ? " (you)" : ""}
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="field-row">
            {confirmLeave ? (
              <>
                <span>Leave {group.name}?</span>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await leaveGroup();
                    setBusy(false);
                    setConfirmLeave(false);
                    setMessage("You left the group.");
                  }}
                >
                  Leave
                </button>
                <button onClick={() => setConfirmLeave(false)}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmLeave(true)}>Leave group</button>
            )}
          </div>
        </>
      ) : (
        <p>You&apos;re not in a group yet. Join a friend&apos;s group with their invite code, or start your own.</p>
      )}

      <div className="group-actions">
        <button className="group-tile pill-blue" onClick={() => setDialog("join")}>
          <b>Join a group</b>
          <span>Got an invite code from a friend?</span>
        </button>
        <button className="group-tile pill-green" onClick={() => setDialog("create")}>
          <b>Start a new group</b>
          <span>Make one and share its code.</span>
        </button>
      </div>
      {message && <p role="status">{message}</p>}

      {dialog === "join" && (
        <JoinDialog
          onClose={() => setDialog(null)}
          onJoin={async (code) => {
            await joinGroup(code);
            setDialog(null);
            setMessage("Joined!");
          }}
        />
      )}
      {dialog === "create" && (
        <CreateDialog
          onClose={() => setDialog(null)}
          onCreate={async (name) => {
            await createGroup(name);
            setDialog(null);
            setMessage("Group created! Share the invite code.");
          }}
        />
      )}
    </div>
  );
}

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function JoinDialog({ onClose, onJoin }: { onClose: () => void; onJoin: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const { busy, error, submit } = useSubmit(() => onJoin(code));
  return (
    <Modal title="Join a group" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="hint">Type the 6-character invite code your friend shared.</p>
        <input
          aria-label="Invite code"
          className="code-input"
          value={code}
          maxLength={6}
          placeholder="ABC123"
          autoComplete="off"
          data-autofocus
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        {error && (
          <p role="alert" className="note-held">
            {error}
          </p>
        )}
        <div className="field-row">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="pill-blue" type="submit" disabled={busy || code.trim().length !== 6}>
            {busy ? "Joining..." : "Join"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const { busy, error, submit } = useSubmit(() => onCreate(name));
  return (
    <Modal title="Start a new group" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="hint">Give it a name. You&apos;ll get an invite code to share with friends.</p>
        <input aria-label="Group name" value={name} maxLength={40} placeholder="Night owls" data-autofocus onChange={(e) => setName(e.target.value)} />
        {error && (
          <p role="alert" className="note-held">
            {error}
          </p>
        )}
        <div className="field-row">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="pill-green" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

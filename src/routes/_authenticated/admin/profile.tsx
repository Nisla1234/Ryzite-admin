import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/use-me";
import { changeMyPassword, updateMyProfile, uploadMyAvatar } from "@/lib/auth.functions";
import { passwordProblems } from "@/lib/password";
import { primaryRole, ROLE_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  head: () => ({
    meta: [
      { title: "My Profile · RYZITE Control Centre" },
      { name: "description", content: "Your administrator profile and password." },
    ],
  }),
  component: ProfilePage,
});

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const saveProfileFn = useServerFn(updateMyProfile);
  const uploadAvatarFn = useServerFn(uploadMyAvatar);
  const changePasswordFn = useServerFn(changeMyPassword);
  const role = primaryRole(me.roles);
  const [fullName, setFullName] = useState(me.profile.full_name);
  const [jobTitle, setJobTitle] = useState(me.profile.job_title);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfileFn({
        data: {
          fullName: fullName.trim().slice(0, 120),
          jobTitle: jobTitle.trim().slice(0, 120),
        },
      });
      toast.success("Profile saved");
      await router.invalidate();
    } catch {
      toast.error("Profile couldn't be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
      return void toast.error("Use a PNG, JPG or WebP image.");
    }
    if (file.size > 3 * 1024 * 1024) {
      return void toast.error("The image must be 3 MB or smaller.");
    }
    setUploading(true);
    try {
      const ext = (file.type.split("/")[1] ?? "png") as "png" | "jpeg" | "webp";
      const dataUrl = await readFileAsDataUrl(file);
      const res = await uploadAvatarFn({ data: { ext, dataUrl } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["avatar-url"] });
      toast.success("Photo updated");
      await router.invalidate();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const problems = passwordProblems(pw.next);
    if (problems.length) return void toast.error(problems[0]);
    if (pw.next !== pw.confirm) return void toast.error("The new passwords don't match.");
    setPwBusy(true);
    try {
      const res = await changePasswordFn({
        data: { currentPassword: pw.current, newPassword: pw.next },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed");
    } catch {
      toast.error("Password not changed. Check your current password.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="System Management"
        title="My Profile"
        description="Your details, photo and password."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                path={me.profile.avatar_url}
                name={me.profile.full_name || me.profile.username}
                className="size-16"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}{" "}
                Change photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={uploadAvatar}
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={me.profile.username} disabled />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={role ? ROLE_LABELS[role] : ""} disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={me.user.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn">Full name</Label>
              <Input
                id="fn"
                value={fullName}
                maxLength={120}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jt">Job title</Label>
              <Input
                id="jt"
                value={jobTitle}
                maxLength={120}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save profile
            </Button>
          </form>
        </Panel>
        <Panel title="Change password">
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cp">Current password</Label>
              <Input
                id="cp"
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np">New password</Label>
              <Input
                id="np"
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf">Confirm new password</Label>
              <Input
                id="cf"
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              At least 12 characters with upper and lower case letters, a number and a symbol.
            </p>
            <Button type="submit" variant="hero" disabled={pwBusy || !pw.current || !pw.next}>
              {pwBusy && <Loader2 className="animate-spin" />} Change password
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

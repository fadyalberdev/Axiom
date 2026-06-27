"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfileMutation, type UpdateProfileInput } from "@/lib/queries";
import { buildE164, EGYPT_PHONE_REGEX, toLocalEgyptPhone } from "@/lib/phoneUtils";
import { useAuthStore } from "@/stores/authStore";
import type { AuthUser } from "@/types";

interface ProfileCompletionModalProps {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
}

function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const hadBirthday =
    today.getMonth() > born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export default function ProfileCompletionModal({
  user,
  open,
  onClose,
}: ProfileCompletionModalProps) {
  const queryClient = useQueryClient();
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  const [form, setForm] = useState({
    phone: toLocalEgyptPhone(user.phone),
    gender: user.gender ?? "",
    birth_date: user.birth_date?.slice(0, 10) ?? "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    ...updateProfileMutation,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] }),
        refreshProfile(),
      ]);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // Validate
    const localPhone = form.phone.replace(/\D/g, "");
    if (!localPhone) {
      setError("Phone number is required.");
      return;
    }
    if (!EGYPT_PHONE_REGEX.test(localPhone)) {
      setError("Phone number must be a valid Egyptian number (e.g. 01012345678).");
      return;
    }
    if (!form.gender) {
      setError("Gender is required.");
      return;
    }
    if (!form.birth_date) {
      setError("Birth date is required.");
      return;
    }

    const age = calculateAge(form.birth_date);
    if (age !== null && (age < 16 || age > 100)) {
      setError("Age must be between 16 and 100.");
      return;
    }

    const e164Phone = buildE164("+20", localPhone);
    const payload: UpdateProfileInput = {
      phone: e164Phone,
      whatsapp_number: e164Phone,
      country_code: "+20",
      gender: form.gender as "male" | "female",
      birth_date: form.birth_date,
    };

    mutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-[#151515] border-white/10 text-white" showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <UserCircle className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-center text-zinc-400">
            Welcome, {user.full_name || user.email}! Please fill in a few details to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-300 sm:col-span-2">
              Phone / WhatsApp
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="01012345678"
                className="h-10 rounded-lg border-white/10 bg-white/5 text-white"
                required
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-zinc-300">
              Gender
              <Select
                value={form.gender}
                onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}
              >
                <SelectTrigger className="h-10 rounded-lg border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="male" className="text-white">Male</SelectItem>
                  <SelectItem value="female" className="text-white">Female</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-zinc-300 sm:col-span-2">
              Birth Date
              <Input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                className="h-10 rounded-lg border-white/10 bg-white/5 text-white"
                required
              />
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-lg bg-primary text-white hover:bg-primary/90"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Profile
            </Button>
            <p className="text-center text-xs text-zinc-500">
              You can update these details anytime in your profile settings.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// V2/frontend/src/components/dashboard/MyListings.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, ImageIcon, Loader2, Eye } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteListingMutation } from "@/lib/queries";
import type { DashboardListing } from "@/types";

interface MyListingsProps {
  listings: DashboardListing[];
  onAddNew: () => void;
  onEdit?: (listingId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-green-500/10 text-green-400 border-green-500/10",
  pending:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/10",
  rejected: "bg-red-500/10 text-red-400 border-red-500/10",
  draft:    "bg-gray-500/10 text-gray-400 border-gray-500/10",
  paused:   "bg-amber-500/10 text-amber-400 border-amber-500/10",
};

const STATUS_DOT: Record<string, string> = {
  active:   "bg-green-500",
  pending:  "bg-yellow-500",
  rejected: "bg-red-500",
  draft:    "bg-gray-500",
  paused:   "bg-amber-500",
};

const STATUS_LABEL: Record<string, string> = {
  active:   "Active",
  pending:  "Pending Review",
  rejected: "Rejected",
  draft:    "Draft",
  paused:   "Paused",
};

export default function MyListings({ listings, onAddNew, onEdit }: MyListingsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { mutate: deleteListing, isPending: isDeleting } = useMutation({
    ...deleteListingMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
      setConfirmDeleteId(null);
    },
  });

  function handleDeleteClick(id: string) {
    setConfirmDeleteId(id);
  }

  function handleDeleteConfirm() {
    if (confirmDeleteId) deleteListing(confirmDeleteId);
  }

  return (
    <>
      <section className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-4 sm:p-6 md:flex-row md:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Listing pipeline
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">My Listings</h2>
            <p className="mt-1 text-sm text-gray-400">
              New listings require admin approval before going live.
            </p>
          </div>
          <button
            onClick={onAddNew}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,90,60,0.18)] transition-[background-color,transform,opacity] duration-150 ease-out hover:bg-primary-hover active:scale-[0.98]"
          >
            <PlusCircle className="h-5 w-5" /> Add New Listing
          </button>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-[0.16em] text-gray-500">
                <th className="p-5 font-semibold">Property</th>
                <th className="p-5 font-semibold">Location</th>
                <th className="p-5 font-semibold">Status</th>
                <th className="p-5 font-semibold text-right">Price</th>
                <th className="p-5 font-semibold text-center">Views</th>
                <th className="p-5 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {listings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]">
                        <PlusCircle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-white">No listings yet</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Add your first property and it will enter the approval queue.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                listings.map((listing) => (
                  <tr
                    key={listing.id}
                    onClick={(e) => {
                      // Prevent navigation if the user clicked an interactive element (button, link, etc.)
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("a")) {
                        return;
                      }
                      router.push(`/property/${listing.id}`);
                    }}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                  >
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        {listing.image ? (
                          <Image
                            src={listing.image}
                            alt={listing.name}
                            width={64}
                            height={48}
                            className="w-16 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                            <ImageIcon className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-bold text-base">{listing.name}</p>
                          <p className="text-gray-500 text-xs">ID: {listing.listingId}</p>
                          {listing.status === "paused" && (
                            <p className="mt-1 text-xs text-amber-400">
                              Hidden — <a href="/pricing" onClick={(e) => e.stopPropagation()} className="underline hover:text-amber-300">subscribe to restore</a>. Deleted after grace period.
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-gray-400">{listing.location}</td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[listing.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[listing.status]}`} />
                        {STATUS_LABEL[listing.status] ?? listing.status}
                      </span>
                    </td>
                    <td className="p-5 text-right text-white font-medium">
                      {listing.price}
                      {listing.priceSuffix && (
                        <span className="text-gray-500 text-xs font-normal">{listing.priceSuffix}</span>
                      )}
                    </td>
                    <td className="p-5 text-center text-gray-300">{listing.views}</td>
                    <td className="p-5 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(listing.id);
                          }}
                          className="rounded-lg p-2 text-gray-400 transition-[background-color,color,transform] duration-150 hover:bg-red-500/10 hover:text-red-400 active:scale-[0.96]"
                          title="Delete listing"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#151515] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <h3 className="text-white font-bold text-lg mb-2">Delete Listing?</h3>
            <p className="text-gray-400 text-sm mb-6">
              This action cannot be undone. The listing will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm font-bold text-gray-300 transition-[background-color,color,transform] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
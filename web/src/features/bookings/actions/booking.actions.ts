'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { bookingSchema, paymentSchema } from '../schemas/booking.schema';
import { saveBooking, finalizeBooking, recordPayment, reversePayment, searchGuests, updateStayStatus, getBooking } from '../services/bookings.service';
import { STATUSES } from '../types/booking.types';
function refresh() { revalidatePath('/dashboard/bookings', 'layout'); }
export async function saveBookingAction(input: unknown) { const id = await saveBooking(bookingSchema.parse(input)); refresh(); return id; }
export async function finalizeBookingAction(id: string) { await finalizeBooking(z.string().uuid().parse(id)); refresh(); }
export async function recordPaymentAction(input: unknown) { await recordPayment(paymentSchema.parse(input)); refresh(); }
export async function reversePaymentAction(id: string, reason: string) { await reversePayment(z.string().uuid().parse(id), z.string().trim().min(5).max(1000).parse(reason)); refresh(); }
export async function searchGuestsAction(search: string) { return searchGuests(z.string().max(100).parse(search)); }
export async function updateStayStatusAction(id: string, status: string) { await updateStayStatus(z.string().uuid().parse(id), z.enum(STATUSES).parse(status)); refresh(); }
export async function getBookingDetailsAction(id: string) { return getBooking(z.string().uuid().parse(id)); }

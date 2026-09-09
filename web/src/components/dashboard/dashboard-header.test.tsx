import { render,screen,within,cleanup } from '@testing-library/react';
import { afterEach,describe,it,expect,vi } from 'vitest';
import { DashboardHeader } from './dashboard-header';
import type { DashboardSession } from '@/lib/dashboard/session';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/components/logo',()=>({Logo:()=> <span>Everloft</span>}));
afterEach(cleanup);
const session:DashboardSession={userId:'test',username:'Test user',email:'test@example.com',role:'super_admin',roleLabel:'Super Admin',roleSlug:'super-admin',permissions:['manage_properties','manage_booking_register']};
describe('dashboard booking navigation',()=>{
 it.each(['super_admin','finance_admin'] as const)('shows clear register and creation shortcuts for authorized %s',role=>{
  render(<DashboardHeader session={{...session,role}}/>);
  const nav=within(screen.getByRole('navigation',{name:'Booking shortcuts'}));
  expect(nav.getByRole('link',{name:'Bookings & Settlements'})).toHaveAttribute('href','/dashboard/bookings');
  expect(nav.getByRole('link',{name:'Add booking'})).toHaveAttribute('href','/dashboard/bookings/new');
 });
 it('does not expose finance navigation without its explicit permission',()=>{
  render(<DashboardHeader session={{...session,permissions:['view_financials'],role:'investor'}}/>);
  expect(screen.queryByRole('navigation',{name:'Booking shortcuts'})).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Add booking'})).not.toBeInTheDocument();
 });
});

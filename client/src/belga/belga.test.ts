import {describe,expect,it} from 'vitest';import {settings,QUOTE_STATUSES} from './model';
describe('BELGA WOOD client domain',()=>{it('keeps safe defaults',()=>{expect(settings.companyName).toBe('BELGA WOOD');expect(settings.phone).toBe('')});it('supports quote workflow statuses',()=>expect(QUOTE_STATUSES).toContain('in_progress'))});

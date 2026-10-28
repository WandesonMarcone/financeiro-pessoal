import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import {cleanup} from '@testing-library/react';
import {afterEach,beforeEach} from 'vitest';
import {localDB} from '../src/offline';
beforeEach(async()=>{localStorage.clear();sessionStorage.clear();await localDB.outbox.clear();await localDB.snapshots.clear();});
afterEach(cleanup);


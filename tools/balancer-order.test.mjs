import assert from 'node:assert';
import { read, slice } from './_slice.mjs';

const src = read('online_mod.js');
const code = slice(src, 'balancer-order');

const store = {};
const Lampa = {
  Storage: {
    get: (k, d) => (store[k] !== undefined ? store[k] : (k === 'online_mod_order' ? [] : d)),
    set: (k, v) => { store[k] = v; }
  }
};

const Balancers = [{ name: 'a' }, { name: 'b' }, { name: 'c', disabled: true }, { name: 'd' }];
const { applyOrder, moveBalancer } = new Function('Balancers', 'Lampa', code + '\nreturn { applyOrder, moveBalancer };')(Balancers, Lampa);

function reset() {
  Balancers.length = 0;
  Balancers.push({ name: 'a' }, { name: 'b' }, { name: 'c', disabled: true }, { name: 'd' });
  for (const k in store) delete store[k];
  applyOrder.base = undefined;
}

// 'top' on 'd'
{
  reset();
  moveBalancer('d', 'top');
  assert.deepStrictEqual(Balancers.map((b) => b.name), ['d', 'a', 'b', 'c']);
}

// up (-1) on the first enabled changes nothing
{
  reset();
  applyOrder();
  const before = Balancers.map((b) => b.name).slice();
  const firstEnabled = Balancers.filter((b) => !b.disabled)[0].name;
  moveBalancer(firstEnabled, -1);
  assert.deepStrictEqual(Balancers.map((b) => b.name), before);
}

// down (1) on the last enabled changes nothing
{
  reset();
  applyOrder();
  const before = Balancers.map((b) => b.name).slice();
  const enabled = Balancers.filter((b) => !b.disabled);
  moveBalancer(enabled[enabled.length - 1].name, 1);
  assert.deepStrictEqual(Balancers.map((b) => b.name), before);
}

// unknown name writes nothing to storage
{
  reset();
  applyOrder();
  moveBalancer('zzz', 1);
  assert.strictEqual(store['online_mod_order'], undefined);
}

// applyOrder with stored ['b'] puts b first, rest in original order
{
  reset();
  store['online_mod_order'] = ['b'];
  applyOrder();
  assert.deepStrictEqual(Balancers.map((b) => b.name), ['b', 'a', 'c', 'd']);
}

// move 'a' down one place: a and b swap, disabled stays last
{
  reset();
  applyOrder();
  moveBalancer('a', 1);
  assert.deepStrictEqual(store['online_mod_order'], ['b', 'a', 'd', 'c']);
}

console.log('balancer-order OK');

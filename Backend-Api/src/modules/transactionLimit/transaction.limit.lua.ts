export const CHECK_AND_INCREMENT_SCRIPT = `
  local current = tonumber(redis.call('GET', KEYS[1])) or 0
  local limit   = tonumber(ARGV[1])
  local amount  = tonumber(ARGV[2])
  local ttl     = tonumber(ARGV[3])

  if current + amount > limit then
    return -1
  end

  local new_total = redis.call('INCRBY', KEYS[1], amount)
  if new_total == amount then
    redis.call('EXPIRE', KEYS[1], ttl)
  end
  return new_total
`;

export const CHECK_AND_INCREMENT_VELOCITY_SCRIPT = `
  local current = tonumber(redis.call('GET', KEYS[1])) or 0
  local limit   = tonumber(ARGV[1])
  local ttl     = tonumber(ARGV[2])

  if current >= limit then
    return -1
  end

  local new_count = redis.call('INCR', KEYS[1])
  if new_count == 1 then
    redis.call('EXPIRE', KEYS[1], ttl)
  end
  return new_count
`;
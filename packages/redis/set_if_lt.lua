local key = KEYS[1]
local cur_val = redis.call('GET', key)
local new_val = ARGV[1]

if not cur_val or tonumber(new_val) < tonumber(cur_val) then
    redis.call('SET', key, new_val, unpack(ARGV, 2))
    return 1
end

return 0

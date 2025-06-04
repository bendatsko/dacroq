#!/usr/bin/env python3
import lgpio
import time

def test_all_teensy_resets():
    """Test all three Teensy reset GPIO pins in sequence"""
    print("🔄 Starting comprehensive Teensy reset GPIO test...")
    print("Testing all three Teensy reset lines:")
    print("  • GPIO 18 → LDPC Teensy (AMORGOS)")
    print("  • GPIO 19 → 3SAT Teensy (DAEDALUS)")  
    print("  • GPIO 20 → KSAT Teensy (MEDUSA)")
    print("\nPress Ctrl+C to stop at any time")
    
    # GPIO pin assignments
    gpio_configs = [
        {"pin": 18, "name": "LDPC", "chip": "AMORGOS"},
        {"pin": 19, "name": "3SAT", "chip": "DAEDALUS"},
        {"pin": 20, "name": "KSAT", "chip": "MEDUSA"}
    ]
    
    try:
        # Open GPIO chip
        h = lgpio.gpiochip_open(0)
        print("✅ GPIO chip 0 opened")
        
        # Initialize all pins as outputs (HIGH = reset inactive)
        for config in gpio_configs:
            lgpio.gpio_claim_output(h, config["pin"], 1)
            print(f"✅ GPIO {config['pin']} claimed as output ({config['name']} {config['chip']} reset control)")
        
        print("\n" + "="*60)
        print("🎯 Starting sequential reset test (2 cycles per Teensy)")
        print("="*60)
        
        # Test each GPIO pin
        for config in gpio_configs:
            pin = config["pin"]
            name = config["name"]
            chip = config["chip"]
            
            print(f"\n📍 Testing {name} Teensy ({chip}) on GPIO {pin}:")
            print("-" * 40)
            
            for cycle in range(2):  # 2 cycles per Teensy
                # Activate reset (LOW)
                lgpio.gpio_write(h, pin, 0)
                state = lgpio.gpio_read(h, pin)
                print(f"  Cycle {cycle+1}: RESET ACTIVE  → GPIO {pin} = {state} (0V) - {name} Teensy resetting")
                time.sleep(1.5)  # Hold reset
                
                # Release reset (HIGH)
                lgpio.gpio_write(h, pin, 1)
                state = lgpio.gpio_read(h, pin)
                print(f"  Cycle {cycle+1}: RESET RELEASED → GPIO {pin} = {state} (3.3V) - {name} Teensy running")
                time.sleep(2)    # Let it run
        
        print("\n" + "="*60)
        print("🚀 Testing simultaneous reset of all Teensys...")
        print("="*60)
        
        # Simultaneous reset test
        print("📍 Activating ALL resets simultaneously...")
        for config in gpio_configs:
            lgpio.gpio_write(h, config["pin"], 0)
            print(f"  • GPIO {config['pin']} → {config['name']} reset ACTIVE")
        
        print("⏳ Holding all resets for 2 seconds...")
        time.sleep(2)
        
        print("📍 Releasing ALL resets simultaneously...")
        for config in gpio_configs:
            lgpio.gpio_write(h, config["pin"], 1)
            print(f"  • GPIO {config['pin']} → {config['name']} reset RELEASED")
        
        print("⏳ Waiting for all Teensys to boot...")
        time.sleep(3)
        
        print("\n" + "="*60)
        print("✅ All GPIO reset tests completed successfully!")
        print("="*60)
        
        # Final status check
        print("\n📊 Final GPIO status:")
        for config in gpio_configs:
            state = lgpio.gpio_read(h, config["pin"])
            status = "INACTIVE (normal)" if state else "ACTIVE (resetting)"
            print(f"  • GPIO {config['pin']} ({config['name']}): {state} - {status}")
        
        # Cleanup
        for config in gpio_configs:
            lgpio.gpio_free(h, config["pin"])
        lgpio.gpiochip_close(h)
        print("\n✅ GPIO cleanup successful")
        
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
        try:
            # Ensure all pins are released (set HIGH)
            for config in gpio_configs:
                try:
                    lgpio.gpio_write(h, config["pin"], 1)
                    lgpio.gpio_free(h, config["pin"])
                except:
                    pass
            lgpio.gpiochip_close(h)
            print("✅ GPIO cleanup successful")
        except:
            pass
            
    except Exception as e:
        print(f"\n❌ GPIO test failed: {e}")
        print(f"Error type: {type(e).__name__}")
        try:
            # Emergency cleanup
            for config in gpio_configs:
                try:
                    lgpio.gpio_write(h, config["pin"], 1)
                    lgpio.gpio_free(h, config["pin"])
                except:
                    pass
            lgpio.gpiochip_close(h)
            print("✅ Emergency GPIO cleanup completed")
        except:
            pass

if __name__ == "__main__":
    test_all_teensy_resets() 
class HexUtil {

    static bytesToHex(bytes) {
        return Array.from(bytes).map((byte) => {
            return byte.toString(16).padStart(2, "0");
        }).join("");
    }

}

export default HexUtil;

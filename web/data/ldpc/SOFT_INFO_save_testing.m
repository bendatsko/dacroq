function SOFT_INFO_save_testing(DAC_bits,SNR)

numTests = size(DAC_bits,2);



% generate ntst csv files for teensy WITH soft info
parfor noise = 1:length(SNR)
    info = zeros(numTests, 1);
    tic;
    for i = 1:numTests
        for j = 1:24
            osc_col=strcat('0000',num2str(DAC_bits(noise,i,(j-1)*16+16)),num2str(DAC_bits(noise,i,(j-1)*16+15)), ...
                num2str(DAC_bits(noise,i,(j-1)*16+14)),num2str(DAC_bits(noise,i,(j-1)*16+13)),'0000',...
                num2str(DAC_bits(noise,i,(j-1)*16+12)),num2str(DAC_bits(noise,i,(j-1)*16+11)),...
                num2str(DAC_bits(noise,i,(j-1)*16+10)),num2str(DAC_bits(noise,i,(j-1)*16+9)),'0000',...
                num2str(DAC_bits(noise,i,(j-1)*16+8)),num2str(DAC_bits(noise,i,(j-1)*16+7)),...
                num2str(DAC_bits(noise,i,(j-1)*16+6)),num2str(DAC_bits(noise,i,(j-1)*16+5)),'0000',...
                num2str(DAC_bits(noise,i,(j-1)*16+4)),num2str(DAC_bits(noise,i,(j-1)*16+3)),...
                num2str(DAC_bits(noise,i,(j-1)*16+2)),num2str(DAC_bits(noise,i,(j-1)*16+1)));
    
            info(24*(i-1) + j) = bin2dec(osc_col);
        end
    end
    filename = string(SNR(noise)) + "dB/SOFT_INFO/info.bin";
    BIN = fopen(filename, "w");
    fwrite(BIN, info, "uint32");
    fclose(BIN);
    toc;
end

for noise = 1:length(SNR)
    tic;
    % Generate input file for teensy WITHOUT soft info
    for i=1:numTests
        for j=1:24
            osc_col=strcat('0000',num2str(DAC_bits(noise,i,(j-1)*16+16)),'1110000',...
                num2str(DAC_bits(noise,i,(j-1)*16+12)),'1110000',...
                num2str(DAC_bits(noise,i,(j-1)*16+8)),'1110000',...
                num2str(DAC_bits(noise,i,(j-1)*16+4)),'111');
    
            info(24*(i-1) + j) = bin2dec(osc_col);
        end
    end
    filename = string(SNR(noise)) + "dB/HARD_INFO/info.bin";
    BIN = fopen(filename, "w");
    fwrite(BIN, info, "uint32");
    fclose(BIN);
    toc;
end

% Project: Script for Generating Data from AWGN for Amorgos IC
% Authors: Evangelos Dikopoulos, Luke Wormald 

%% Set up test vectors and LDPC settings

clear;  % Clear workspace variables
rng(1); % Fix random number generator seed      

tic;

% Load H matrix
H = load('./MacKay_96_3_963.mat','ethernet').ethernet.H';      
[eqns,n] = size(H);

SNR = 3:1:10;           % SNR Range
numTest = 76800;        % Number of test vectors per SNR step

sigma = 1 ./ sqrt(SNR); 
lenSNR = length(SNR);   % Number of SNR steps
 
% True if all zero word, false for nonzero words (loaded)
zerocode = true;

% Initialize RX_id matrix
RX_id = zeros(lenSNR, numTest, n);    % Ideal zero word

% If not using zero code
if ~zerocode
    load("codes1-10.mat")   % Load coded_sig from workspace
    code_sel = 2;           % Select code to load from coded_sig
    
    for i = 1:lenSNR        % For all SNRs
        for j = 1:numTest   % For all tests
            % Store ideal nonzero word
            RX_id(i,j,:) = coded_sig(code_sel,:);     
        end
    end
end

% BPSK modulated vectors
RX_mod = (RX_id .* -2) + 1; 

% Channel outputs
RX_chn = zeros(lenSNR, numTest, n);
parfor i = 1:lenSNR
    RX_chn(i,:,:) = awgn(RX_mod(i,:,:), SNR(i));
end

% Calculate hard decision
RX_hard = (sign(RX_chn) - 1) / -2;

toc;

%% Set up osc array

tic;

% set inital voltage of osc-array
osc_init_q = zeros(lenSNR,numTest,n);

step = 1/8;

parfor i=1:lenSNR
    for j=1:numTest
        for k=1:n
            llrabs = abs(RX_chn(i,j,k));            
            if llrabs <= 1                         
                tmpv = 0.5 - 0.5*RX_chn(i,j,k);       % max DAC val = 0.5 now
                osc_init_q(i,j,k) = floor(tmpv/step); % ADC conv       
            end
        end
    end
end

DAC_bits = zeros(lenSNR,numTest,4*n);

% save DAC init values:
for i = 1:lenSNR
    for j = 1:numTest
        for k = 1:n
            binv = not(de2bi(osc_init_q(i,j,k),3));
            DAC_bits(i,j,(k-1)*4+1) = binv(1);
            DAC_bits(i,j,(k-1)*4+2) = binv(2);
            DAC_bits(i,j,(k-1)*4+3) = binv(3);
            DAC_bits(i,j,(k-1)*4+4) = RX_hard(i,j,k);
        end
    end
end

toc;

SOFT_INFO_save_testing(DAC_bits,SNR);
